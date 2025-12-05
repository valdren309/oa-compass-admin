// /src/app/app.module.ts
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import {
  AlertModule,
  CloudAppTranslateModule,
  MaterialModule
} from '@exlibris/exl-cloudapp-angular-lib';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MainComponent } from './main/main.component';
import { UserInfoComponent } from './components/user-info/user-info.component';
import { OAStatusComponent } from './components/status/status.component';
import { OAProvisionComponent } from './components/provision/provision.component';
import { ToastComponent } from './components/toast/toast.component';
import { SettingsComponent } from './components/settings/settings.component';
import { ConfigComponent } from './components/config/config.component';
import { UserSearchComponent } from './components/user-search/user-search.component';
import { UserShellComponent } from './components/user-shell/user-shell.component';
import { AppHeaderComponent } from './components/app-header/app-header.component';

@NgModule({
  declarations: [
    AppComponent,
    MainComponent,
    UserInfoComponent,
    OAStatusComponent,
    OAProvisionComponent,
    ToastComponent,
    SettingsComponent,
    ConfigComponent,
    UserSearchComponent,
    UserShellComponent,
    AppHeaderComponent
  ],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    MaterialModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    AlertModule,
    CloudAppTranslateModule.forRoot(),
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [
    provideHttpClient(withInterceptorsFromDi())
  ]
})
export class AppModule {}
