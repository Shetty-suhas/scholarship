import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { map, Observable, of, Subscription, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth-service.service';
import { ScholarshipService, Scholarship } from '../services/scholarship.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  scholarships: Scholarship[] = [];
  filteredScholarships: Scholarship[] = [];
  categories: string[] = ['All', 'Undergraduate', 'Graduate', 'International', 'Merit-based', 'Need-based'];
  selectedCategory: string = 'All';
  userName: string = 'User';
  private fragmentSubscription: Subscription | undefined;
  private userSubscription: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private scholarshipService: ScholarshipService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.scholarshipService.getScholarships().subscribe({
      next: (scholarships: any) => {
        this.scholarships = scholarships;
        this.filteredScholarships = [...this.scholarships];
      },
      error: (error: any) => {
        console.error('Failed to load scholarships:', error);
        alert('Could not load scholarships. Please try again later.');
      }
    });

    this.fragmentSubscription = this.route.fragment.subscribe(fragment => {
      if (fragment) {
        setTimeout(() => this.scrollToSection(fragment), 0);
      }
    });

    this.userSubscription = this.authService.user$.subscribe(user => {
      this.userName = user?.displayName || 'User';
    });
  }

  scrollTo(fragment: string): void {
    const element = document.getElementById(fragment);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  ngOnDestroy(): void {
    if (this.fragmentSubscription) {
      this.fragmentSubscription.unsubscribe();
    }
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  filterByCategory(category: string): void {
    this.selectedCategory = category;
    if (category === 'All') {
      this.filteredScholarships = [...this.scholarships];
    } else {
      this.filteredScholarships = this.scholarships.filter(
        scholarship => scholarship.category === category
      );
    }
  }

  hasApplied(scholarshipId: string): Observable<boolean> {
    return this.authService.user$.pipe(
      switchMap(user => {
        if (!user?.uid) {
          return of(false);
        }
        return this.http.get<{ hasApplied: boolean }>(
          `http://localhost:5000/api/applications/user/${user.uid}/scholarship/${scholarshipId}`
        ).pipe(map(response => response.hasApplied));
      })
    );
  }

  private scrollToSection(fragment: string): void {
    const element = document.getElementById(fragment);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  logout(): void {
    this.authService.signOut().catch(error => {
      console.error('Logout error:', error);
      alert('Failed to log out. Please try again.');
    });
  }
}