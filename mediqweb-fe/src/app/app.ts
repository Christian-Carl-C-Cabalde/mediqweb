import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly swatches = [
    '--color-primary',
    '--color-primary-dark',
    '--color-primary-light',
    '--color-surface',
    '--color-background',
    '--color-border',
    '--color-text-secondary',
    '--color-success',
    '--color-warning',
    '--color-danger',
    '--color-info',
  ];
}
