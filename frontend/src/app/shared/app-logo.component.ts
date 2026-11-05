import { Component, input } from '@angular/core';

/** Gauge mark (docs/ux/ui-design.md 8.3). Decorative; takes currentColor, accent arc stays teal. */
@Component({
  selector: 'app-logo',
  template: `
    <svg class="app-logo" viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()" aria-hidden="true" focusable="false">
      <path d="M6.34 17.66A8 8 0 1 1 17.66 17.66" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".45" />
      <path d="M6.34 17.66A8 8 0 0 1 17.14 5.87" fill="none" stroke="#5eead4" stroke-width="2.4" stroke-linecap="round" />
      <path d="M12 12l2.9-3.45" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  `,
  styles: `:host { display: inline-flex; flex: none; } svg { display: block; }`,
})
export class AppLogoComponent {
  readonly size = input(20);
}
