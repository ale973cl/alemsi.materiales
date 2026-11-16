-- ALEMSI: correlativo configurado a partir del próximo número a emitir.
-- Preparar/aplicar solamente tras validar en entorno de pruebas.
-- No cambia números de guías existentes.
CREATE OR REPLACE FUNCTION public.dispatch_guide_sequence_status()
RETURNS TABLE(next_number bigint, highest_issued bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_role text; v_last bigint; v_called bool; v_high bigint;
BEGIN
 SELECT role INTO v_role FROM public.user_profiles WHERE id=(SELECT auth.uid()) AND active=true;
 IF v_role NOT IN ('Admin Total','Gerencia','Admin') OR v_role IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
 SELECT last_value,is_called INTO v_last,v_called FROM public.dispatch_internal_number_seq;
 SELECT COALESCE(max((substring(internal_number FROM '-([0-9]+)$'))::bigint),0) INTO v_high
 FROM public.dispatches WHERE internal_number ~ '^GI-[0-9]{8}-[0-9]+$';
 RETURN QUERY SELECT greatest(v_last+(CASE WHEN v_called THEN 1 ELSE 0 END),v_high+1),v_high;
END $$;

CREATE OR REPLACE FUNCTION public.configure_dispatch_guide_next_number(p_next bigint)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_role text; v_last bigint; v_called bool; v_high bigint; v_min bigint; v_actor uuid:=auth.uid();
BEGIN
 SELECT role INTO v_role FROM public.user_profiles WHERE id=v_actor AND active=true;
 IF v_role IS DISTINCT FROM 'Admin Total' THEN RAISE EXCEPTION 'Solo Admin Total puede configurar el correlativo'; END IF;
 IF p_next IS NULL OR p_next<1 OR p_next>999999 THEN RAISE EXCEPTION 'El número debe estar entre 1 y 999999'; END IF;
 -- Bloqueo contra creaciones de guías en curso; el reinicio de secuencia es transaccional.
 LOCK TABLE public.dispatches IN SHARE ROW EXCLUSIVE MODE;
 SELECT last_value,is_called INTO v_last,v_called FROM public.dispatch_internal_number_seq;
 SELECT COALESCE(max((substring(internal_number FROM '-([0-9]+)$'))::bigint),0) INTO v_high
 FROM public.dispatches WHERE internal_number ~ '^GI-[0-9]{8}-[0-9]+$';
 v_min:=greatest(v_high+1,v_last+(CASE WHEN v_called THEN 1 ELSE 0 END));
 IF p_next<v_min THEN RAISE EXCEPTION 'El próximo correlativo no puede ser menor que %',v_min; END IF;
 EXECUTE format('ALTER SEQUENCE public.dispatch_internal_number_seq RESTART WITH %s',p_next);
 INSERT INTO public.activity_log(actor_id,actor_name,module,action,entity_table,new_data)
 VALUES(v_actor,'Admin Total','Despachos','Configurar correlativo guía','dispatches',
        jsonb_build_object('previous_next',v_min,'configured_next',p_next));
 RETURN p_next;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_guide_sequence_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.configure_dispatch_guide_next_number(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_guide_sequence_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.configure_dispatch_guide_next_number(bigint) TO authenticated;
