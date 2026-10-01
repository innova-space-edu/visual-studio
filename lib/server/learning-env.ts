function value(name:string){
  return String(process.env[name]||"").trim();
}

export function learningEnv(){
  const supabaseUrl=value("LEARNING_SUPABASE_URL");
  const supabaseServiceKey=value("LEARNING_SUPABASE_SERVICE_ROLE_KEY");
  const googleClientId=value("GOOGLE_DRIVE_CLIENT_ID");
  const googleClientSecret=value("GOOGLE_DRIVE_CLIENT_SECRET");
  const googleRedirectUri=value("GOOGLE_DRIVE_REDIRECT_URI");
  return {
    supabaseUrl,
    supabaseServiceKey,
    googleClientId,
    googleClientSecret,
    googleRedirectUri,
    tokenEncryptionKey:value("LEARNING_TOKEN_ENCRYPTION_KEY")||googleClientSecret,
    tokenEncryptionUsesDedicatedKey:!!value("LEARNING_TOKEN_ENCRYPTION_KEY"),
    adminEmails:value("LEARNING_ADMIN_EMAILS").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean)
  };
}

export function requireLearningEnv(){
  const env=learningEnv();
  const missing:string[]=[];
  if(!env.supabaseUrl)missing.push("LEARNING_SUPABASE_URL");
  if(!env.supabaseServiceKey)missing.push("LEARNING_SUPABASE_SERVICE_ROLE_KEY");
  if(!env.googleClientId)missing.push("GOOGLE_DRIVE_CLIENT_ID");
  if(!env.googleClientSecret)missing.push("GOOGLE_DRIVE_CLIENT_SECRET");
  if(!env.googleRedirectUri)missing.push("GOOGLE_DRIVE_REDIRECT_URI");
  if(missing.length)throw new Error("Missing environment variables: "+missing.join(", "));
  return env;
}
