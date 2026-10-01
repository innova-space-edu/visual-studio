"use client";

import {useEffect,useRef} from "react";
import {EditorContent,useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";

interface Props{
  html:string;
  onChange:(value:{html:string;text:string})=>void;
}

export default function RichTextEditor({html,onChange}:Props){
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const editor=useEditor({
    immediatelyRender:false,
    extensions:[
      StarterKit,
      TextAlign.configure({types:["heading","paragraph"]})
    ],
    content:html||"<p></p>",
    onUpdate:({editor})=>{
      if(timer.current)clearTimeout(timer.current);
      timer.current=setTimeout(()=>onChange({html:editor.getHTML(),text:editor.getText({blockSeparator:"\n"})}),250);
    }
  });

  useEffect(()=>{
    if(!editor)return;
    const current=editor.getHTML();
    if(html&&html!==current)editor.commands.setContent(html,{emitUpdate:false});
  },[html,editor]);

  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);

  if(!editor)return <div className="richLoading">Cargando editor…</div>;

  const setLink=()=>{
    const current=editor.getAttributes("link").href||"";
    const href=window.prompt("URL del enlace",current);
    if(href===null)return;
    if(!href.trim()){editor.chain().focus().unsetLink().run();return;}
    editor.chain().focus().extendMarkRange("link").setLink({href:href.trim(),target:"_blank"}).run();
  };

  return <div className="richEditor">
    <div className="richToolbar">
      <button className={editor.isActive("bold")?"active":""} onClick={()=>editor.chain().focus().toggleBold().run()}><b>B</b></button>
      <button className={editor.isActive("italic")?"active":""} onClick={()=>editor.chain().focus().toggleItalic().run()}><i>I</i></button>
      <button className={editor.isActive("underline")?"active":""} onClick={()=>editor.chain().focus().toggleUnderline().run()}><u>U</u></button>
      <button className={editor.isActive("strike")?"active":""} onClick={()=>editor.chain().focus().toggleStrike().run()}><s>S</s></button>
      <button onClick={()=>editor.chain().focus().toggleHeading({level:2}).run()}>H2</button>
      <button onClick={()=>editor.chain().focus().toggleBulletList().run()}>• Lista</button>
      <button onClick={()=>editor.chain().focus().toggleOrderedList().run()}>1. Lista</button>
      <button onClick={()=>editor.chain().focus().setTextAlign("left").run()}>Izq.</button>
      <button onClick={()=>editor.chain().focus().setTextAlign("center").run()}>Centro</button>
      <button onClick={()=>editor.chain().focus().setTextAlign("right").run()}>Der.</button>
      <button className={editor.isActive("link")?"active":""} onClick={setLink}>Link</button>
      <button onClick={()=>editor.chain().focus().undo().run()}>↶</button>
      <button onClick={()=>editor.chain().focus().redo().run()}>↷</button>
    </div>
    <EditorContent editor={editor}/>
  </div>;
}
