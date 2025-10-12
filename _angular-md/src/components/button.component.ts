import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'custom-button',
  standalone: true,
  template: `
    <button 
      [class]="buttonClass" 
      (click)="handleClick()"
      [disabled]="disabled">
      {{ label }}
    </button>
  `,
  styles: [`
    .btn {
      padding: 12px 24px;
      border-radius: 8px;
      border: none;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 14px;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
    }
    
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
    }
    
    .btn-secondary {
      background: #f7fafc;
      color: #4a5568;
      border: 2px solid #e2e8f0;
    }
    
    .btn-secondary:hover:not(:disabled) {
      background: #edf2f7;
      border-color: #cbd5e0;
    }
    
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class CustomButtonComponent {
  @Input() label: string = 'Click me';
  @Input() variant: 'primary' | 'secondary' = 'primary';
  @Input() disabled: boolean = false;
  @Output() onClick = new EventEmitter<void>();

  get buttonClass(): string {
    return `btn btn-${this.variant}`;
  }

  handleClick(): void {
    if (!this.disabled) {
      this.onClick.emit();
    }
  }
}