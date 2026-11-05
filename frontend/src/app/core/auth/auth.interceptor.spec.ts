import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { authInterceptor } from './auth.interceptor';
import { AuthService, TOKEN_KEY } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let auth: AuthService;
  let snack: jasmine.SpyObj<MatSnackBar>;
  let navigate: jasmine.Spy;

  beforeEach(() => {
    localStorage.setItem(TOKEN_KEY, 'tok123');
    snack = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: snack },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  afterEach(() => {
    ctrl.verify();
    localStorage.removeItem(TOKEN_KEY);
  });

  it('attaches the bearer token to API calls but not to login', () => {
    http.get('/api/models').subscribe();
    expect(ctrl.expectOne('/api/models').request.headers.get('Authorization')).toBe('Bearer tok123');
    http.post('/api/auth/login', {}).subscribe();
    expect(ctrl.expectOne('/api/auth/login').request.headers.has('Authorization')).toBeFalse();
  });

  it('on 401 clears the token and goes to /login', () => {
    http.get('/api/models').subscribe({ error: () => undefined });
    ctrl.expectOne('/api/models').flush({ error: { code: 'UNAUTHENTICATED' } }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.token()).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('on 403 ACCOUNT_DISABLED clears the session, shows a message and goes to /login', () => {
    http.get('/api/models').subscribe({ error: () => undefined });
    ctrl.expectOne('/api/models').flush({ error: { code: 'ACCOUNT_DISABLED' } }, { status: 403, statusText: 'Forbidden' });
    expect(auth.token()).toBeNull();
    expect(snack.open).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('on a plain 403 FORBIDDEN keeps the session', () => {
    http.get('/api/admin/users').subscribe({ error: () => undefined });
    ctrl.expectOne('/api/admin/users').flush({ error: { code: 'FORBIDDEN' } }, { status: 403, statusText: 'Forbidden' });
    expect(auth.token()).toBe('tok123');
    expect(navigate).not.toHaveBeenCalled();
  });
});
