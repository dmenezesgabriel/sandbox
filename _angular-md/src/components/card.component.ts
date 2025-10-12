import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'custom-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-header" *ngIf="title">
        <h3 class="card-title">{{ title }}</h3>
        <p class="card-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
      </div>
      <div class="card-content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      margin: 20px 0;
      overflow: hidden;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
    }
    
    .card-header {
      padding: 24px 24px 0 24px;
    }
    
    .card-title {
      margin: 0 0 8px 0;
      font-size: 20px;
      font-weight: 700;
      color: #2d3748;
    }
    
    .card-subtitle {
      margin: 0;
      color: #718096;
      font-size: 14px;
    }
    
    .card-content {
      padding: 24px;
    }
  `]
})
export class CustomCardComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
}