import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router'; // Si usas rutas

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `<router-outlet></router-outlet>`, // O el selector de tu componente de login directamente
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'frontend';
}
