// src/app/app-routing.module.ts
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MainComponent } from './main/main.component';
import { SettingsComponent } from './components/settings/settings.component';
import { ConfigComponent } from './components/config/config.component';

const routes: Routes = [
  // Entity-aware main view
  { path: '', component: MainComponent },

  // User-level settings (CloudAppSettingsService)
  { path: 'settings', component: SettingsComponent },

  // Institution-level configuration (CloudAppConfigService)
  { path: 'config', component: ConfigComponent },

  // Fallback
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
