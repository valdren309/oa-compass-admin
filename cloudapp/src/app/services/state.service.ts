// src/app/services/state.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AlmaUser } from '../models/alma-user.model';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private userSubject = new BehaviorSubject<AlmaUser | null>(null);
  private busySubject = new BehaviorSubject<boolean>(false);
  private lastProxyResponseSubject = new BehaviorSubject<string>('');

  // --- User ---

  setUser(user: AlmaUser | null): void {
    this.userSubject.next(user);
  }

  getUser(): Observable<AlmaUser | null> {
    return this.userSubject.asObservable();
  }

  // --- Busy flag ---

  setBusy(isBusy: boolean): void {
    this.busySubject.next(isBusy);
  }

  getBusy(): Observable<boolean> {
    return this.busySubject.asObservable();
  }

  // --- Last proxy response (debug panel) ---

  setLastProxyResponse(text: string): void {
    this.lastProxyResponseSubject.next(text || '');
  }

  getLastProxyResponse(): Observable<string> {
    return this.lastProxyResponseSubject.asObservable();
  }
}
