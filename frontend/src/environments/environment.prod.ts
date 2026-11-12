export const environment = {
  production: true,
  apiUrl: import.meta.env['NG_APP_API_URL'] || '',
  cognito: {
    region: import.meta.env['NG_APP_COGNITO_REGION'] || '',
    userPoolId: import.meta.env['NG_APP_COGNITO_USER_POOL_ID'] || '',
    clientId: import.meta.env['NG_APP_COGNITO_CLIENT_ID'] || ''
  }
};


