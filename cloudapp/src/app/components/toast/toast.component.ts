import { Component, Input, Output, EventEmitter } from '@angular/core';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

@Component({
  selector: 'oa-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss']
})
export class ToastComponent {
  @Input() message: string | null = null;
  @Input() type: ToastType = 'info';

  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }
}
