import { Component, Input } from '@angular/core';

@Component({
  selector: 'oa-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss']
})
export class OAStatusComponent {
  @Input() actionStatus: string = '';
  @Input() lastProxyResponse: string = '';
  @Input() busy: boolean = false;
}
