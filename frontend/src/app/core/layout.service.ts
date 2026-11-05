import { Injectable, inject } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** Viewport buckets from docs/ux/ui-design.md section 3. */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly bp = inject(BreakpointObserver);
  /** Under 600 px. */
  readonly mobile = toSignal(this.bp.observe('(max-width: 599.98px)').pipe(map((s) => s.matches)), {
    initialValue: this.bp.isMatched('(max-width: 599.98px)'),
  });
  /** Under 1024 px (sidebar becomes an over-mode drawer). */
  readonly compact = toSignal(this.bp.observe('(max-width: 1023.98px)').pipe(map((s) => s.matches)), {
    initialValue: this.bp.isMatched('(max-width: 1023.98px)'),
  });
}
