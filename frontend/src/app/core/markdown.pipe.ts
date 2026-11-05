import { Pipe, PipeTransform } from '@angular/core';
import { renderMarkdown } from './markdown';

@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value ? renderMarkdown(value) : '';
  }
}
