import { CommonModule } from '@angular/common';
import { Component, Input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card.component.html',
  styleUrl: './card.component.css',
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class CardComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
}
