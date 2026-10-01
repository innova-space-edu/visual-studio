import type { Metadata } from "next";
import "./globals.css";

export const metadata:Metadata={
  title:"Visual Engine Studio",
  description:"Local-first deterministic visual engine laboratory by Innova Space Education."
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="es"><body>{children}</body></html>;
}
