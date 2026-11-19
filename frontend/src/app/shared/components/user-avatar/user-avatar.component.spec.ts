import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { UserAvatarComponent } from './user-avatar.component';

describe('UserAvatarComponent', () => {
  async function setup(avatar: string | null) {
    await TestBed.configureTestingModule({ imports: [UserAvatarComponent] }).compileComponents();

    const fixture = TestBed.createComponent(UserAvatarComponent);
    fixture.componentRef.setInput('name', 'Raghav Shastri');
    fixture.componentRef.setInput('avatar', avatar);
    fixture.detectChanges();

    return fixture;
  }

  it('resolves an uploaded avatar path to the API origin', async () => {
    const fixture = await setup('/api/users/507f1f77bcf86cd799439011/avatar');
    const image: HTMLImageElement = fixture.nativeElement.querySelector('img');

    expect(image.getAttribute('src')).toBe(
      `${environment.apiUrl}/users/507f1f77bcf86cd799439011/avatar`,
    );
  });

  it('uses an external image URL unchanged', async () => {
    const url = 'https://cdn.example.com/profile.png';
    const fixture = await setup(url);
    const image: HTMLImageElement = fixture.nativeElement.querySelector('img');

    expect(image.getAttribute('src')).toBe(url);
  });

  it('falls back to initials when the image cannot be loaded', async () => {
    const fixture = await setup('https://cdn.example.com/missing.png');
    const image: HTMLImageElement = fixture.nativeElement.querySelector('img');

    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('RS');
  });
});
