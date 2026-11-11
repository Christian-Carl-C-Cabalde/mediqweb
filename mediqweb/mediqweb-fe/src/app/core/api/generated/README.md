## @mediq/api@1.0.0

This generator creates TypeScript/JavaScript client that utilizes [axios](https://github.com/axios/axios). The generated Node module can be used in the following environments:

Environment
* Node.js
* Webpack
* Browserify

Language level
* ES5 - you must have a Promises/A+ library installed
* ES6

Module system
* CommonJS
* ES6 module system

It can be used in both TypeScript and JavaScript. In TypeScript, the definition will be automatically resolved via `package.json`. ([Reference](https://www.typescriptlang.org/docs/handbook/declaration-files/consumption.html))

### Building

To build and compile the typescript sources to javascript use:
```
npm install
npm run build
```

### Publishing

First build the package then run `npm publish`

### Consuming

navigate to the folder of your consuming project and run one of the following commands.

_published:_

```
npm install @mediq/api@1.0.0 --save
```

_unPublished (not recommended):_

```
npm install PATH_TO_GENERATED_PACKAGE --save
```

### Documentation for API Endpoints

All URIs are relative to *http://localhost:8099*

Class | Method | HTTP request | Description
------------ | ------------- | ------------- | -------------
*DefaultApi* | [**adminAccountsGet**](docs/DefaultApi.md#adminaccountsget) | **GET** /admin/accounts | List all accounts (admin only)
*DefaultApi* | [**appointmentsGet**](docs/DefaultApi.md#appointmentsget) | **GET** /appointments | List appointments visible to the authenticated user
*DefaultApi* | [**appointmentsIdGet**](docs/DefaultApi.md#appointmentsidget) | **GET** /appointments/{id} | Fetch a single appointment
*DefaultApi* | [**authRefreshPost**](docs/DefaultApi.md#authrefreshpost) | **POST** /auth/refresh | Refresh an access token
*DefaultApi* | [**authRegisterPost**](docs/DefaultApi.md#authregisterpost) | **POST** /auth/register | Register a new account
*DefaultApi* | [**authSignInPost**](docs/DefaultApi.md#authsigninpost) | **POST** /auth/sign-in | Sign in and obtain an access token
*DefaultApi* | [**doctorsGet**](docs/DefaultApi.md#doctorsget) | **GET** /doctors | Search doctors
*DefaultApi* | [**doctorsIdAvailabilityGet**](docs/DefaultApi.md#doctorsidavailabilityget) | **GET** /doctors/{id}/availability | Available slots of a doctor for a date
*DefaultApi* | [**doctorsIdGet**](docs/DefaultApi.md#doctorsidget) | **GET** /doctors/{id} | Fetch a single doctor
*DefaultApi* | [**doctorsIdScheduleGet**](docs/DefaultApi.md#doctorsidscheduleget) | **GET** /doctors/{id}/schedule | Weekly clinic hours of a doctor
*DefaultApi* | [**healthGet**](docs/DefaultApi.md#healthget) | **GET** /health | Health check
*DefaultApi* | [**messagesConversationsGet**](docs/DefaultApi.md#messagesconversationsget) | **GET** /messages/conversations | List message conversations
*DefaultApi* | [**messagesConversationsIdMessagesGet**](docs/DefaultApi.md#messagesconversationsidmessagesget) | **GET** /messages/conversations/{id}/messages | List the messages of a conversation
*DefaultApi* | [**messagesConversationsIdMessagesPost**](docs/DefaultApi.md#messagesconversationsidmessagespost) | **POST** /messages/conversations/{id}/messages | Post a message to a conversation
*DefaultApi* | [**notificationsGet**](docs/DefaultApi.md#notificationsget) | **GET** /notifications | List notifications for the authenticated user
*DefaultApi* | [**profileGet**](docs/DefaultApi.md#profileget) | **GET** /profile | Fetch the authenticated profile
*DefaultApi* | [**specializationsGet**](docs/DefaultApi.md#specializationsget) | **GET** /specializations | List specializations


### Documentation For Models

 - [AuthSession](docs/AuthSession.md)
 - [RegisterRequest](docs/RegisterRequest.md)
 - [SignInRequest](docs/SignInRequest.md)
 - [UserProfile](docs/UserProfile.md)


<a id="documentation-for-authorization"></a>
## Documentation For Authorization


Authentication schemes defined for the API:
<a id="bearerAuth"></a>
### bearerAuth

- **Type**: Bearer authentication (JWT)

