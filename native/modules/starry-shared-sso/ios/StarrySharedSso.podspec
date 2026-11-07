Pod::Spec.new do |s|
  s.name           = 'StarrySharedSso'
  s.version        = '0.1.0'
  s.summary        = 'Device-only shared Starry SSO token'
  s.description    = 'Signature-protected local SSO transport for Expo development builds'
  s.license        = { :type => 'MIT' }
  s.author         = 'Starry'
  s.homepage       = 'https://github.com/starry-phd/RecordNote'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://github.com/starry-phd/RecordNote.git', :tag => s.version.to_s }
  s.static_framework = true
  s.source_files   = 'ios/**/*.{swift,h,m}'
  s.dependency 'ExpoModulesCore'
end
