import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { AlmaUser } from '../../models/alma-user.model';

@Component({
  selector: 'oa-user-shell',
  templateUrl: './user-shell.component.html',
  styleUrls: ['./user-shell.component.scss', './user-shell.component.theme.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserShellComponent {

  @Input() user: AlmaUser | null = null;
  @Input() selectedUserId: string | null = null;

  @Input() busy = false;
  @Input() actionStatus = '';
  @Input() lastProxyResponse = '';
  @Input() showDebugPanel = false;

  @Input() displayName: string | null = null;
  @Input() email: string | null = null;
  @Input() userGroup: string | null = null;
  @Input() expiry: string | null = null;
  @Input() oaUsername: string | null = null;

  @Output() create = new EventEmitter<void>();
  @Output() sync = new EventEmitter<void>();
  @Output() verify = new EventEmitter<void>();
  @Output() reload = new EventEmitter<void>();
  @Output() newSearch = new EventEmitter<void>();

  onCreate(): void {
    this.create.emit();
  }

  onSync(): void {
    this.sync.emit();
  }

  onVerify(): void {
    this.verify.emit();
  }

  onReload(): void {
    this.reload.emit();
  }

  onNewSearch(): void {
    this.newSearch.emit();
  }
}
