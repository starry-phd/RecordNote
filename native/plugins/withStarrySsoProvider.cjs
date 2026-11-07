const {withAndroidManifest}=require('@expo/config-plugins');
// Do not register this provider in additional Starry Apps: they must connect
// to the single designated broker authority and hold the SAME Android signer.
module.exports=function withStarrySsoProvider(config){
 return withAndroidManifest(config,mod=>{
  const manifest=mod.modResults.manifest;
  const permission='phd.starry.sso.permission.SHARED';
  manifest.permission=manifest.permission||[];
  if(!manifest.permission.some(x=>x.$?.['android:name']===permission))
    manifest.permission.push({$:{'android:name':permission,'android:protectionLevel':'signature'}});
  manifest['uses-permission']=manifest['uses-permission']||[];
  if(!manifest['uses-permission'].some(x=>x.$?.['android:name']===permission))
    manifest['uses-permission'].push({$:{'android:name':permission}});
  const app=manifest.application?.[0];
  if(!app)throw Error('Android application manifest missing');
  app.provider=app.provider||[];
  const authority='phd.starry.recordnote.sso';
  if(!app.provider.some(x=>x.$?.['android:authorities']===authority))
    app.provider.push({$:{
      'android:name':'phd.starry.sso.StarrySsoProvider',
      'android:authorities':authority,
      'android:exported':'true',
      'android:permission':permission
    }});
  return mod;
 });
};
