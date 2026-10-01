import type { Metadata } from "next";
import "./globals.css";

export const metadata:Metadata={
  metadataBase:new URL("https://studio.visual.innova-space-edu.cl"),
  title:{
    default:"Visual Engine Studio",
    template:"%s · Visual Engine Studio"
  },
  description:"Local-first deterministic visual engine laboratory by Innova Space Education.",
  applicationName:"Visual Engine Studio",
  alternates:{canonical:"/"},
  robots:{index:true,follow:true},
  openGraph:{
    type:"website",
    locale:"es_CL",
    url:"https://studio.visual.innova-space-edu.cl",
    siteName:"Visual Engine Studio",
    title:"Visual Engine Studio",
    description:"Motor gráfico determinista, local-first y extensible."
  }
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="es"><body>{children}</body></html>;
}
