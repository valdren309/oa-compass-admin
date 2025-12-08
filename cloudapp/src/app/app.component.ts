// src/app/app.component.ts
import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  template: `<router-outlet></router-outlet>`
})
export class AppComponent {
  constructor(private translate: TranslateService) {
    // Default to English, and let Alma override if a different language is set
    this.translate.setDefaultLang('en');

    // In the Cloud App container, Alma usually sets the language;
    // but in local dev (eca start) we explicitly use English.
    const browserLang = this.translate.getBrowserLang();
    this.translate.use(browserLang || 'en');
  }
}
