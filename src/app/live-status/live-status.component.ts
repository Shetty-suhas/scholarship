import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { AuthService } from '../auth/auth-service.service';
import { Subscription, forkJoin } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

interface ApplicationStatus {
  status: 'Submitted' | 'Under Review' | 'Accepted' | 'Rejected' | 'Awarded';
  date: string;
  notes?: string;
}

interface ScholarshipApplication {
  id: string;
  title: string;
  provider: string;
  amount: string;
  deadline: string;
  submittedDate: string;
  currentStatus: ApplicationStatus['status'];
  statusHistory: ApplicationStatus[];
}

interface BackendApplication {
  id: string;
  scholarship_id: string;
  user_id: string;
  student_name: string;
  student_email: string;
  status: 'Submitted' | 'Under Review' | 'Accepted' | 'Rejected' | 'Awarded';
  submitted_at: string;
  documents: { name: string; file_id: string }[];
}

interface Scholarship {
  id: string;
  title: string;
  provider: string;
  amount: string;
  deadline: string;
  category: string;
  description: string;
  age_range: string;
  income_range: string;
  required_documents: string[];
  created_at: string;
}

@Component({
  selector: 'app-live-status',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule],
  templateUrl: './live-status.component.html',
  styleUrls: ['./live-status.component.css']
})
export class LiveStatusComponent implements OnInit, OnDestroy {
  applications: ScholarshipApplication[] = [];
  selectedApplication: ScholarshipApplication | null = null;
  showDetailView: boolean = false;
  totalApplications: number = 0;
  awardedCount: number = 0;
  inProgressCount: number = 0;
  userName: string = 'User';
  loading: boolean = true;
  error: string | null = null;
  private userSubscription: Subscription | undefined;

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.userSubscription = this.authService.user$.pipe(
      switchMap(user => {
        this.userName = user?.displayName || 'User';
        if (!user?.uid) {
          this.loading = false;
          this.error = 'User not authenticated. Please sign in.';
          return [];
        }
        this.loading = true;
        this.error = null;
        return this.http.get<BackendApplication[]>(`http://localhost:5000/api/applications/user/${user.uid}`).pipe(
          switchMap(applications => {
            // Fetch scholarship details for each application
            const scholarshipRequests = applications.map(app =>
              this.http.get<Scholarship>(`http://localhost:5000/api/scholarships/${app.scholarship_id}`)
                .pipe(map(scholarship => ({ app, scholarship })))
            );
            return forkJoin(scholarshipRequests.length ? scholarshipRequests : [[]]).pipe(
              map(results => this.mapToScholarshipApplications(applications, results))
            );
          })
        );
      })
    ).subscribe({
      next: (apps) => {
        this.applications = apps;
        this.calculateStatistics();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching applications:', err);
        this.error = 'Failed to load applications. Please try again.';
        this.loading = false;
      }
    });
  }

  private mapToScholarshipApplications(
    backendApps: BackendApplication[],
    results: { app: BackendApplication; scholarship: Scholarship }[]
  ): ScholarshipApplication[] {
    return backendApps.map(backendApp => {
      const scholarship = results.find(r => r.app.id === backendApp.id)?.scholarship;
      // Directly use backend status, with notes for history
      const currentStatus = backendApp.status;
      let notes: string | undefined;
      switch (currentStatus) {
        case 'Submitted':
          notes = 'Application submitted successfully';
          break;
        case 'Under Review':
          notes = 'Your application is currently being reviewed';
          break;
        case 'Accepted':
          notes = 'Your application has been accepted';
          break;
        case 'Awarded':
          notes = 'Congratulations! You have been awarded this scholarship';
          break;
        case 'Rejected':
          notes = 'We regret to inform you that your application was not selected';
          break;
      }

      // Create status history
      const statusHistory: ApplicationStatus[] = [
        {
          status: 'Submitted',
          date: new Date(backendApp.submitted_at).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          notes: 'Application submitted successfully'
        }
      ];
      if (backendApp.status !== 'Submitted') {
        statusHistory.push({
          status: currentStatus,
          date: new Date().toLocaleString('en-US', { // Placeholder: use current date
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          notes
        });
      }

      return {
        id: backendApp.id,
        title: scholarship?.title || 'Unknown Scholarship',
        provider: scholarship?.provider || 'Unknown Provider',
        amount: scholarship?.amount || 'N/A',
        deadline: scholarship?.deadline || 'N/A',
        submittedDate: new Date(backendApp.submitted_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        currentStatus,
        statusHistory
      };
    });
  }

  calculateStatistics(): void {
    this.totalApplications = this.applications.length;
    this.awardedCount = this.applications.filter(app => app.currentStatus === 'Awarded').length;
    this.inProgressCount = this.applications.filter(
      app => app.currentStatus === 'Submitted' || app.currentStatus === 'Under Review' || app.currentStatus === 'Accepted'
    ).length;
  }

  viewApplicationDetails(application: ScholarshipApplication): void {
    this.selectedApplication = application;
    this.showDetailView = true;
  }

  closeDetailView(): void {
    this.showDetailView = false;
    this.selectedApplication = null;
  }

  getStatusClass(status: ApplicationStatus['status']): string {
    switch (status) {
      case 'Submitted':
        return 'status-submitted';
      case 'Under Review':
        return 'status-reviewing';
      case 'Accepted':
        return 'status-accepted';
      case 'Rejected':
        return 'status-rejected';
      case 'Awarded':
        return 'status-awarded';
      default:
        return '';
    }
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  logout(): void {
    this.authService.signOut().catch(error => {
      console.error('Logout error:', error);
      alert('Failed to log out. Please try again.');
    });
  }
}