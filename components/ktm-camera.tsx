"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function KtmCamera({ onPhoto, onError }: { onPhoto: (photo: string) => void; onError: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const request = useRef(0);
  const [still, setStill] = useState("");
  const [ready, setReady] = useState(false);
  function stop() {
    request.current++;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }
  useEffect(() => {
    window.addEventListener("pagehide", stop);
    return () => { stop(); window.removeEventListener("pagehide", stop); };
  }, []);
  async function start() {
    stop();
    const id = request.current;
    setStill(""); setReady(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error();
      if (!dialog.current?.open) dialog.current?.showModal();
      const camera = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
      if (request.current !== id || !video.current) { camera.getTracks().forEach(t => t.stop()); return; }
      stream.current = camera;
      video.current.srcObject = camera;
      await video.current.play();
      if (request.current === id) setReady(true);
    } catch (error) {
      if (request.current !== id) return;
      stop(); dialog.current?.close();
      onError(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Izin kamera ditolak. Izinkan kamera di browser atau pilih foto dari galeri."
        : "Kamera tidak tersedia. Gunakan HTTPS atau localhost, atau pilih foto dari galeri.");
    }
  }
  function capture() {
    const frame = video.current;
    if (!frame?.videoWidth) return;
    const scale = Math.min(1,1600 / Math.max(frame.videoWidth,frame.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(frame.videoWidth * scale); canvas.height = Math.round(frame.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) { stop(); dialog.current?.close(); onError("Foto gagal diambil. Coba galeri."); return; }
    ctx.drawImage(frame,0,0,canvas.width,canvas.height);
    setStill(canvas.toDataURL("image/jpeg",0.8)); stop();
  }
  return <><button type="button" className="secondary" onClick={start}>Foto KTM</button>
    <dialog ref={dialog} className="listing-dialog camera-dialog" aria-label="Foto KTM" onClose={() => { if (!dialog.current?.open) stop(); }} onCancel={stop}>
      <p>Posisikan seluruh kartu di dalam bingkai.</p>
      <div className="camera-frame"><video ref={video} hidden={!!still} muted playsInline />{still &&
        <Image width={800} height={500} unoptimized src={still} alt="Hasil pengambilan foto" />}</div>
      <div className="form-actions">{still ? <><button type="button" className="secondary" onClick={start}>Foto Ulang</button>
        <button type="button" className="primary" onClick={() => { onPhoto(still); dialog.current?.close(); }}>Gunakan Foto</button></> :
        <button type="button" className="primary" disabled={!ready} onClick={capture}>Ambil Foto</button>}
        <button type="button" className="secondary" onClick={() => { stop(); dialog.current?.close(); }}>Batal</button></div>
    </dialog></>;
}
