# AuthSession


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**accessToken** | **string** |  | [optional] [default to undefined]
**expiresAt** | **string** |  | [optional] [default to undefined]
**refreshToken** | **string** |  | [optional] [default to undefined]
**refreshExpiresAt** | **string** |  | [optional] [default to undefined]
**profile** | [**UserProfile**](UserProfile.md) |  | [optional] [default to undefined]

## Example

```typescript
import { AuthSession } from '@mediq/api';

const instance: AuthSession = {
    accessToken,
    expiresAt,
    refreshToken,
    refreshExpiresAt,
    profile,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
