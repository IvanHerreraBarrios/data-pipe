import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent {
  email = '';
  password = '';
  isRegistering = false;
  message = '';
  errorMessage = '';

  constructor(private authService: AuthService, private router: Router) {}

  async onSubmit() {
    this.message = '';
    this.errorMessage = '';
    try {
      if (this.isRegistering) {
        this.message = await this.authService.register(this.email, this.password);
      } else {
        await this.authService.login(this.email, this.password);
        this.router.navigate(['/dashboard']);
      }
    } catch (err: any) {
      this.errorMessage = err;
    }
  }

  toggleMode() {
    this.isRegistering = !this.isRegistering;
  }
}
