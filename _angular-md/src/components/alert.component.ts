import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "custom-alert",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="alertClass" role="alert">
      <div class="alert-icon">{{ icon }}</div>
      <div class="alert-content">
        <h4 class="alert-title" *ngIf="title">{{ title }}</h4>
        <p class="alert-message">{{ message }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      .alert {
        display: flex;
        align-items: flex-start;
        padding: 16px;
        border-radius: 8px;
        margin: 16px 0;
        border-left: 4px solid;
      }

      .alert-icon {
        font-size: 20px;
        margin-right: 12px;
        margin-top: 2px;
      }

      .alert-content {
        flex: 1;
      }

      .alert-title {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 600;
      }

      .alert-message {
        margin: 0;
        line-height: 1.5;
      }

      .alert-info {
        background: #ebf8ff;
        border-color: #3182ce;
        color: #2c5282;
      }

      .alert-success {
        background: #f0fff4;
        border-color: #38a169;
        color: #276749;
      }

      .alert-warning {
        background: #fffbeb;
        border-color: #d69e2e;
        color: #b7791f;
      }

      .alert-error {
        background: #fed7d7;
        border-color: #e53e3e;
        color: #c53030;
      }
    `,
  ],
})
export class CustomAlertComponent {
  @Input() type: "info" | "success" | "warning" | "error" = "info";
  @Input() title?: string;
  @Input() message: string = "";

  get alertClass(): string {
    return `alert alert-${this.type}`;
  }

  get icon(): string {
    const icons = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌",
    };
    return icons[this.type];
  }
}
