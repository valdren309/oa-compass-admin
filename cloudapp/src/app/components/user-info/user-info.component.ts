import { Component, Input } from '@angular/core';
import { AlmaUser } from '../../models/alma-user.model';

@Component({
  selector: 'user-info',
  templateUrl: './user-info.component.html',
  styleUrls: ['./user-info.component.scss']
})
export class UserInfoComponent {
  @Input() user: AlmaUser | null = null;
  @Input() selectedUserId: string | null = null;
  @Input() displayName: string | null = null;
  @Input() email: string | null = null;
  @Input() userGroup: string | null = null;
  @Input() expiry: string | null = null;
  @Input() oaUsername: string | null = null;
}
