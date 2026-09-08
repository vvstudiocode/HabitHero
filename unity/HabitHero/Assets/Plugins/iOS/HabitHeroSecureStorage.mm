#import <Foundation/Foundation.h>
#import <Security/Security.h>
#include <cstring>

static NSString *HabitHeroServiceName(void) {
    return @"com.vvstudiocode.habithero.secure";
}

static NSDictionary *HabitHeroQuery(NSString *key) {
    return @{
        (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService: HabitHeroServiceName(),
        (__bridge id)kSecAttrAccount: key,
    };
}

extern "C" bool HabitHeroSecureStorageGet(
    const char *key,
    char *buffer,
    int bufferLength
) {
    if (key == NULL || buffer == NULL || bufferLength <= 1) return false;
    NSString *keyString = [NSString stringWithUTF8String:key];
    if (keyString == nil) return false;

    NSMutableDictionary *query = [HabitHeroQuery(keyString) mutableCopy];
    query[(__bridge id)kSecReturnData] = @YES;
    query[(__bridge id)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;
    CFTypeRef result = NULL;
    OSStatus status = SecItemCopyMatching(
        (__bridge CFDictionaryRef)query,
        &result
    );
    if (status != errSecSuccess || result == NULL) return false;

    NSData *data = (__bridge_transfer NSData *)result;
    NSString *value = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    const char *utf8 = [value UTF8String];
    if (utf8 == NULL) return false;
    size_t length = std::strlen(utf8);
    if (length >= (size_t)bufferLength) return false;
    std::memcpy(buffer, utf8, length + 1);
    return true;
}

extern "C" bool HabitHeroSecureStorageSet(
    const char *key,
    const char *value
) {
    if (key == NULL || value == NULL) return false;
    NSString *keyString = [NSString stringWithUTF8String:key];
    NSString *valueString = [NSString stringWithUTF8String:value];
    if (keyString == nil || valueString == nil) return false;

    NSDictionary *query = HabitHeroQuery(keyString);
    SecItemDelete((__bridge CFDictionaryRef)query);
    NSMutableDictionary *attributes = [query mutableCopy];
    attributes[(__bridge id)kSecValueData] = [valueString dataUsingEncoding:NSUTF8StringEncoding];
    attributes[(__bridge id)kSecAttrAccessible] = (__bridge id)kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly;
    return SecItemAdd((__bridge CFDictionaryRef)attributes, NULL) == errSecSuccess;
}

extern "C" bool HabitHeroSecureStorageClear(const char *key) {
    if (key == NULL) return false;
    NSString *keyString = [NSString stringWithUTF8String:key];
    if (keyString == nil) return false;
    OSStatus status = SecItemDelete((__bridge CFDictionaryRef)HabitHeroQuery(keyString));
    return status == errSecSuccess || status == errSecItemNotFound;
}
