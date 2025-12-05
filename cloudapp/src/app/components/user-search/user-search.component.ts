// src/app/components/user-search/user-search.component.ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AlmaUserLite } from '../../models/alma-user.model';

@Component({
  selector: 'oa-user-search',
  templateUrl: './user-search.component.html',
  styleUrls: ['./user-search.component.scss', './user-search.component.theme.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserSearchComponent {

  // Inputs from MainComponent
  @Input() searchTerm = '';
  @Input() searching = false;
  @Input() searchError?: string;
  @Input() showResults = false;
  @Input() results: AlmaUserLite[] = [];
  @Input() moreAvailable = false;

  // Outputs back to MainComponent
  @Output() searchTermChange = new EventEmitter<string>();
  @Output() searchRequested = new EventEmitter<void>();
  @Output() loadMoreRequested = new EventEmitter<void>();
  @Output() clearRequested = new EventEmitter<void>();
  @Output() userSelected = new EventEmitter<AlmaUserLite>();

  trackUser = (_: number, r: AlmaUserLite) => r.primary_id;

  /** Called from [(ngModel)] on the input, same pattern as the sample app */
  onModelChange(value: string): void {
    this.searchTermChange.emit(value);
  }

  onSearchClick(): void {
    this.searchRequested.emit();
  }

  onClearClick(): void {
    this.clearRequested.emit();
  }

  onLoadMoreClick(): void {
    this.loadMoreRequested.emit();
  }

  onRowClick(user: AlmaUserLite): void {
    this.userSelected.emit(user);
  }
}
