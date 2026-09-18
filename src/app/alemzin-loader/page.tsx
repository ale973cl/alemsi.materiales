'use client';

import { useState } from 'react';

export default function AlemzinLoaderPreview() {
  const [running, setRunning] = useState(true);
  return (
    <main className="demo">
      <section className="card">
        <p className="eyebrow">ALEMSI · PRUEBA VISUAL</p>
        <h1>Loader ALEMZÍN</h1>
        <p className="intro">Prueba aislada del indicador de espera. No reemplaza todavía ningún flujo real de la aplicación.</p>
        <div className="loaderArea" aria-live="polite">
          {running ? (
            <div className="loader">
              <div className="pushScene" aria-label="Procesando">
                <img src="/alemsin-maestro.png" className="alemzin" alt="ALEMZÍN" draggable={false} />
                <div className="box" aria-hidden="true"><span>A</span></div>
              </div>
              <div className="loadingText">Procesando<span className="dots">...</span></div>
            </div>
          ) : <div className="done">Proceso completado</div>}
        </div>
        <button type="button" onClick={() => setRunning(v => !v)}>{running ? 'Simular término' : 'Probar nuevamente'}</button>
        <p className="note">ALEMZÍN se utiliza como imagen completa; la caja es un elemento independiente.</p>
      </section>
      <style jsx>{`
        *{box-sizing:border-box}.demo{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f3f8f7;color:#14355f;font-family:Arial,Helvetica,sans-serif}.card{width:min(560px,100%);padding:30px 24px;text-align:center;background:white;border:1px solid #dce7e5;border-radius:18px;box-shadow:0 12px 32px rgba(20,53,95,.08)}.eyebrow{margin:0 0 7px;color:#168f82;font-size:12px;font-weight:800;letter-spacing:.12em}h1{margin:0;font-size:27px}.intro{margin:10px auto 4px;max-width:440px;color:#536578;font-size:14px;line-height:1.45}.loaderArea{min-height:190px;display:grid;place-items:center;margin:8px 0}.loader{display:grid;justify-items:center;gap:10px}.pushScene{position:relative;width:168px;height:108px}.alemzin{position:absolute;left:21px;bottom:10px;width:76px;height:76px;object-fit:contain;animation:pushMascot 1.7s ease-in-out infinite;transform-origin:70% 85%;user-select:none}.box{position:absolute;left:101px;bottom:15px;width:43px;height:38px;display:grid;place-items:center;border:2px solid #14355f;border-radius:5px;background:#e8f4f1;box-shadow:inset 0 -7px 0 rgba(22,143,130,.12);animation:pushBox 1.7s ease-in-out infinite}.box:before{content:"";position:absolute;left:50%;top:0;height:100%;border-left:2px solid rgba(20,53,95,.22)}.box span{position:relative;z-index:1;font-size:12px;font-weight:900;color:#168f82}.loadingText{font-size:14px;font-weight:750}.dots{display:inline-block;width:20px;overflow:hidden;vertical-align:bottom;animation:dots 1.2s steps(4,end) infinite}.done{font-size:16px;font-weight:800;color:#168f82}button{border:0;border-radius:10px;padding:10px 16px;background:#14355f;color:white;font-size:14px;font-weight:750;cursor:pointer}.note{margin:14px 0 0;color:#718092;font-size:12px}@keyframes pushMascot{0%,15%,100%{transform:translateX(0) rotate(0deg)}45%{transform:translateX(9px) rotate(3deg)}65%{transform:translateX(13px) rotate(4deg)}80%{transform:translateX(5px) rotate(1deg)}}@keyframes pushBox{0%,15%,100%{transform:translateX(0)}45%{transform:translateX(7px)}65%{transform:translateX(12px)}80%{transform:translateX(5px)}}@keyframes dots{0%{width:0}100%{width:20px}}@media(max-width:480px){.card{padding:24px 16px}.pushScene{transform:scale(.9)}}@media(prefers-reduced-motion:reduce){.alemzin,.box,.dots{animation:none!important}}
      `}</style>
    </main>
  );
}
