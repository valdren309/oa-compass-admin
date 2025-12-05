import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AlmaUser } from '../../models/alma-user.model';

@Component({
  selector: 'oa-provision',
  templateUrl: './oa-provision.component.html',
  styleUrls: ['./oa-provision.component.scss']
})
export class OAProvisionComponent {
  @Input() user: AlmaUser | null = null;
  @Input() selectedUserId: string | null = null;
  @Input() busy: boolean = false;

  @Output() create = new EventEmitter<void>();
  @Output() sync = new EventEmitter<void>();
  @Output() verify = new EventEmitter<void>();

  /** Exposed so the template can check if we have a user/ID to act on */
  get hasTargetUser(): boolean {
    return !!(this.user || this.selectedUserId);
  }

  onCreateClick(): void {
    if (this.busy || !this.hasTargetUser) return;
    this.create.emit();
  }

  onSyncClick(): void {
    if (this.busy || !this.hasTargetUser) return;
    this.sync.emit();
  }

  onVerifyClick(): void {
    if (this.busy || !this.hasTargetUser) return;
    this.verify.emit();
  }
}
