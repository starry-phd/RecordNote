import ExpoModulesCore
import Foundation
import Security

/**
 * Resolves the code-signing-time Keychain prefix from the actual signed App's
 * entitlements. The Apple Team ID is never hardcoded into this application.
 */
public class StarrySharedSsoModule: Module {
  private let suffix = ".phd.starry.shared"
  private let service = "phd.starry.device.sso"

  public func definition() -> ModuleDefinition {
    Name("StarrySharedSso")
    AsyncFunction("get") { (key: String) throws -> String? in try self.read(key) }
    AsyncFunction("set") { (key: String, value: String) throws -> Void in try self.write(key, value) }
    AsyncFunction("remove") { (key: String) throws -> Void in try self.remove(key) }
  }

  private func accessGroup() throws -> String {
    guard let task = SecTaskCreateFromSelf(nil),
      let list = SecTaskCopyValueForEntitlement(task, "keychain-access-groups" as CFString, nil) as? [String],
      let group = list.first(where: { $0.hasSuffix(suffix) }) else {
      throw NSError(domain:"StarrySharedSso", code:1,
        userInfo:[NSLocalizedDescriptionKey:"Signed App has no shared Keychain entitlement"])
    }
    return group
  }

  private func query(_ key: String) throws -> [String: Any] {
    guard key == "starry.sso" else {
      throw NSError(domain:"StarrySharedSso",code:2,
        userInfo:[NSLocalizedDescriptionKey:"Unsupported SSO key"])
    }
    return [
      kSecClass as String:kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String:key,
      kSecAttrAccessGroup as String:try accessGroup()
    ]
  }

  private func read(_ key: String) throws -> String? {
    var q = try query(key)
    q[kSecReturnData as String] = true
    q[kSecMatchLimit as String] = kSecMatchLimitOne
    var item:CFTypeRef?
    let status=SecItemCopyMatching(q as CFDictionary,&item)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess,let data=item as? Data,
          let value=String(data:data,encoding:.utf8) else {
      throw NSError(domain:"StarrySharedSso",code:Int(status))
    }
    return value
  }

  private func write(_ key:String,_ value:String) throws {
    guard value.count > 0 && value.count <= 8192 else {
      throw NSError(domain:"StarrySharedSso",code:3)
    }
    let q = try query(key)
    var data = q
    data[kSecValueData as String] = Data(value.utf8)
    data[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    let status=SecItemAdd(data as CFDictionary,nil)
    if status == errSecDuplicateItem {
      let result=SecItemUpdate(q as CFDictionary,
        [kSecValueData as String:Data(value.utf8)] as CFDictionary)
      guard result == errSecSuccess else { throw NSError(domain:"StarrySharedSso",code:Int(result)) }
    } else if status != errSecSuccess {
      throw NSError(domain:"StarrySharedSso",code:Int(status))
    }
  }

  private func remove(_ key:String) throws {
    let status=SecItemDelete(try query(key) as CFDictionary)
    if status != errSecSuccess && status != errSecItemNotFound {
      throw NSError(domain:"StarrySharedSso",code:Int(status))
    }
  }
}
