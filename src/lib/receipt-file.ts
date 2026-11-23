/** Validates receipt file bytes rather than trusting the browser-provided MIME or extension. */
export const MAX_RECEIPT_FILE_BYTES=8*1024*1024;
export type ReceiptMime="application/pdf"|"image/jpeg"|"image/png"|"image/webp";
export function detectReceiptMime(bytes:Uint8Array):ReceiptMime|null {
 const match=(offset:number,signature:number[])=>signature.every((v,i)=>bytes[offset+i]===v);
 // PDFs may contain an optional UTF-8 BOM, but a renamed HTML document is not accepted.
 if(match(0,[37,80,68,70,45])||match(3,[37,80,68,70,45])&&match(0,[239,187,191]))return "application/pdf";
 if(match(0,[255,216,255]))return "image/jpeg";
 if(match(0,[137,80,78,71,13,10,26,10]))return "image/png";
 if(match(0,[82,73,70,70])&&match(8,[87,69,66,80]))return "image/webp";
 return null;
}
export async function inspectReceiptFile(file:Blob):Promise<ReceiptMime> {
 if(!file.size)throw new Error("El archivo está vacío.");
 if(file.size>MAX_RECEIPT_FILE_BYTES)throw new Error("La factura supera el máximo de 8 MB.");
 const signature=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const mime=detectReceiptMime(signature);
 if(!mime)throw new Error("El contenido no corresponde a un PDF, JPG, PNG o WebP válido. Descarga el PDF original y vuelve a seleccionarlo.");
 return mime;
}
