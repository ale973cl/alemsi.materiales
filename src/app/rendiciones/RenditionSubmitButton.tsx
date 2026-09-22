"use client";
import {useFormStatus} from "react-dom";
type Props={className:string;idle:string;pending:string;name?:string;value?:string;disabled?:boolean};
export default function RenditionSubmitButton({className,idle,pending:pendingText,name,value,disabled=false}:Props){
 const {pending}=useFormStatus();
 return <button type="submit" className={className} name={name} value={value} disabled={disabled||pending} aria-busy={pending}>{pending?pendingText:idle}</button>;
}
