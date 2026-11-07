/** Feature release gates. All sensitive operations are disabled unless explicitly enabled. */
export interface FeatureEnvironment {
  STAR_ID_ISSUER?:string;
  STAR_ID_AUDIENCE?:string;
  STAR_ID_JWKS_URL?:string;
  FEATURE_MEMBER_API?:string;
  FEATURE_AUDIO_UPLOAD?:string;
  FEATURE_SHARING?:string;
}
export interface FeatureCapabilities { memberApi:boolean;audioUpload:boolean;sharing:boolean; }
export function capabilities(env:FeatureEnvironment):FeatureCapabilities {
  const configured=Boolean(env.STAR_ID_ISSUER?.startsWith('https://') &&
      env.STAR_ID_JWKS_URL?.startsWith('https://') &&
      env.STAR_ID_AUDIENCE==='starry-recorder');
  const memberApi=configured && env.FEATURE_MEMBER_API==='enabled';
  return {
    memberApi,
    audioUpload:memberApi && env.FEATURE_AUDIO_UPLOAD==='enabled',
    sharing:memberApi && env.FEATURE_SHARING==='enabled'
  };
}
