import { Component, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-model-picker',
  imports: [MatFormFieldModule, MatSelectModule],
  template: `
    <mat-form-field appearance="outline" class="picker" subscriptSizing="dynamic">
      <mat-label>Model</mat-label>
      <mat-select
        data-testid="model-picker"
        [value]="selected()"
        [disabled]="disabled()"
        (selectionChange)="changed.emit($event.value)"
      >
        @for (m of models(); track m) {
          <mat-option [value]="m" data-testid="model-option">{{ m }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
  styles: `.picker { width: 260px; }`,
})
export class ModelPickerComponent {
  readonly models = input<string[]>([]);
  readonly selected = input<string | null>(null);
  readonly disabled = input(false);
  readonly changed = output<string>();
}
