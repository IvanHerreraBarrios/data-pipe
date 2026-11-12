import { Injectable } from '@angular/core';
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } from 'amazon-cognito-identity-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private poolData = {
    UserPoolId: environment.cognito.userPoolId,
    ClientId: environment.cognito.clientId
  };
  private userPool = new CognitoUserPool(this.poolData);

  constructor() {}

  register(email: string, pass: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const attributeList = [new CognitoUserAttribute({ Name: 'email', Value: email })];

      this.userPool.signUp(email, pass, attributeList, [], (err, result: any) => {
        if (err) return reject(err.message || JSON.stringify(err));

        // Usamos 'result' como any para acceder al usuario de forma segura
        const username = result?.user?.getUsername() || email;
        resolve(`Usuario registrado con éxito. Ya puedes iniciar sesión: ${username}`);
      });
    });
  }

  login(email: string, pass: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const authDetails = new AuthenticationDetails({ Username: email, Password: pass });
      const cognitoUser = new CognitoUser({ Username: email, Pool: this.userPool });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          const idToken = session.getIdToken().getJwtToken();
          document.cookie = `datapipe_token=${idToken}; path=/; secure; samesite=strict; max-age=86400`;
          resolve();
        },
        onFailure: (err) => reject(err.message || JSON.stringify(err))
      });
    });
  }

  getToken(): string | null {
    const name = 'datapipe_token=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1);
      if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
    }
    return null;
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  logout() {
    const cognitoUser = this.userPool.getCurrentUser();
    if (cognitoUser) cognitoUser.signOut();
    document.cookie = 'datapipe_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
  }
}
