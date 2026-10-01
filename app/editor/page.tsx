import Link from "next/link";
import SceneEditor from "@/components/SceneEditor";

export default function EditorPage(){
  return <>
    <div className="editorNav"><Link className="navLink" href="/">Studio</Link><Link className="navLink" href="/platform">Plataforma</Link></div>
    <SceneEditor/>
  </>;
}
