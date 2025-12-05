import { Injectable } from '@angular/core';
import { CloudAppEventsService, Entity } from '@exlibris/exl-cloudapp-angular-lib';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class EntityContextService {

  constructor(private events: CloudAppEventsService) {}

  /**
   * Stream of all active Alma entities (as provided by Alma).
   * Used by MainComponent to react when a user is selected in Alma UI.
   */
  watchEntities(): Observable<Entity[]> {
    return this.events.entities$;
  }

  /**
   * Synchronously returns the active Alma User entity if present.
   * NOTE: The Cloud App API provides an entity payload that includes:
   *   { type: 'USER', id: '<primary_id>' }
   */
  getActiveEntity(): Entity | null {
    // CloudAppEventsService does not expose a synchronous getter,
    // so MainComponent should use watchEntities() to receive new entities.
    // This stub returns null; sync detection will come from subscription logic.
    return null;
  }
}
