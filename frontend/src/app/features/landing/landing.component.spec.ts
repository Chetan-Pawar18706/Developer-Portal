import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('should create the landing page', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the hero and the primary call to action', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('From first brief');
    expect(element.querySelector('.hero-actions a')?.textContent).toContain('Start a project');
  });

  it('should list every platform feature', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.feature-card')).toHaveLength(
      fixture.componentInstance.features.length,
    );
    expect(element.querySelectorAll('.role-card')).toHaveLength(
      fixture.componentInstance.roles.length,
    );
  });
});
