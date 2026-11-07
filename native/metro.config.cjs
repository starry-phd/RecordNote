const path=require('node:path');
const {getDefaultConfig}=require('expo/metro-config');
const config=getDefaultConfig(__dirname);
config.watchFolders=[...(config.watchFolders||[]),path.resolve(__dirname,'..')];
// Shared source lives in ../expo and ../vendor. Resolve its native dependencies
// from this isolated SDK 58 project rather than the older root web package.
const shared=['expo-web-browser','expo-crypto','expo-secure-store','react-native-passkey','react','react-native'];
config.resolver.extraNodeModules={...(config.resolver.extraNodeModules||{}),
 ...Object.fromEntries(shared.map(name=>[name,path.join(__dirname,'node_modules',name)]))};
module.exports=config;
