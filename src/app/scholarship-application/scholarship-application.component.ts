import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth-service.service';
import { take } from 'rxjs/operators';

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

interface ApplicationDocument {
  name: string;
  file_id: string;
}

interface BackendApplication {
  id: string;
  scholarship_id: string;
  user_id: string;
  student_name: string;
  student_email: string;
  age: number;
  gender: string;
  dob: string;
  father_name: string;
  mother_name: string;
  annual_income: number;
  status: 'Submitted' | 'Under Review' | 'Accepted' | 'Rejected' | 'Awarded';
  submitted_at: string;
  documents: { name: string; file_id: string }[];
}

@Component({
  selector: 'app-scholarship-application',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, RouterModule],
  templateUrl: './scholarship-application.component.html',
  styleUrls: ['./scholarship-application.component.css']
})
export class ScholarshipApplicationComponent implements OnInit, OnDestroy {
  scholarship: Scholarship | null = null;
  applicationForm!: FormGroup;
  documents: { [key: string]: File | null } = {};
  isSubmitting = false;
  submissionMessage = '';
  showSubmissionMessage = false;
  userName: string = 'Student';
  private userSubscription: Subscription | undefined;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const scholarshipId = this.route.snapshot.paramMap.get('id');
    if (scholarshipId) {
      this.fetchScholarship(scholarshipId);
    } else {
      this.submissionMessage = 'Invalid scholarship ID.';
      this.showSubmissionMessage = true;
    }

    this.userSubscription = this.authService.user$.subscribe(user => {
      this.userName = user?.displayName || 'Student';
    });

    this.createForm();
  }

  private fetchScholarship(id: string): void {
    console.log('Fetching scholarship with ID:', id);
    this.http.get<Scholarship>(`http://localhost:5000/api/scholarships/${id}`)
      .subscribe({
        next: (scholarship) => {
          console.log('Scholarship fetched:', scholarship);
          this.scholarship = scholarship;
          this.initializeDocuments();
        },
        error: (error) => {
          console.error('Error fetching scholarship:', error);
          this.submissionMessage = 'Failed to load scholarship details. Please try again.';
          this.showSubmissionMessage = true;
        }
      });
  }

  private initializeDocuments(): void {
    if (this.scholarship) {
      this.scholarship.required_documents.forEach(doc => {
        this.documents[doc] = null;
      });
    }
  }

  createForm(): void {
    this.applicationForm = this.fb.group({
      studentName: ['', [Validators.required]],
      studentEmail: ['', [Validators.required, Validators.email]],
      age: ['', [Validators.required, Validators.min(15), Validators.max(100)]],
      gender: ['', [Validators.required]],
      dob: ['', [Validators.required]],
      fatherName: ['', [Validators.required]],
      motherName: ['', [Validators.required]],
      annualIncome: ['', [Validators.required, Validators.min(0)]],
      terms: [true, [Validators.requiredTrue]]
    });
  }

  getDocumentId(doc: string): string {
    return `file-${doc.replace(/\s+/g, '-').toLowerCase()}`;
  }

  onFileSelected(event: Event, documentName: string): void {
    const element = event.target as HTMLInputElement;
    const file = element.files?.[0] || null;
    
    if (file) {
      if (file.type !== 'application/pdf') {
        alert(`${documentName} must be a PDF file`);
        element.value = '';
        this.documents[documentName] = null;
        return;
      }
      
      this.documents[documentName] = file;
    }
  }

  isDocumentUploaded(documentName: string): boolean {
    return !!this.documents[documentName];
  }

  areAllDocumentsUploaded(): boolean {
    return this.scholarship?.required_documents.every(doc => this.isDocumentUploaded(doc)) || false;
  }

  async submitApplication(): Promise<void> {
    if (this.applicationForm.invalid) {
      console.log('Form invalid:', this.applicationForm.value, this.applicationForm.errors);
      this.markFormGroupTouched(this.applicationForm);
      return;
    }
    
    if (!this.areAllDocumentsUploaded()) {
      alert('Please upload all required documents before submitting');
      return;
    }
    
    if (!this.scholarship) {
      this.submissionMessage = 'No scholarship selected.';
      this.showSubmissionMessage = true;
      return;
    }

    this.isSubmitting = true;
    this.showSubmissionMessage = false;
    
    try {
      let user: any;
      await this.authService.user$.pipe(take(1)).toPromise().then(u => {
        user = u;
        if (!user?.uid) {
          throw new Error('User not authenticated. Please sign in again.');
        }
      });

      const formData = new FormData();
      formData.append('scholarship_id', this.scholarship.id);
      formData.append('user_id', user.uid);
      formData.append('student_name', this.applicationForm.get('studentName')?.value || '');
      formData.append('student_email', this.applicationForm.get('studentEmail')?.value || '');
      formData.append('age', this.applicationForm.get('age')?.value?.toString() || '');
      formData.append('gender', this.applicationForm.get('gender')?.value || '');
      formData.append('dob', this.applicationForm.get('dob')?.value || '');
      formData.append('father_name', this.applicationForm.get('fatherName')?.value || '');
      formData.append('mother_name', this.applicationForm.get('motherName')?.value || '');
      formData.append('annual_income', this.applicationForm.get('annualIncome')?.value?.toString() || '');
      formData.append('status', 'pending');
      formData.append('submitted_at', new Date().toISOString());

      for (const docName of this.scholarship.required_documents) {
        const file = this.documents[docName];
        if (file) {
          formData.append(docName, file, file.name);
        }
      }

      console.log('Submitting FormData:', formData);

      this.http.post('http://localhost:5000/api/applications', formData)
        .subscribe({
          next: (response: any) => {
            console.log('Application submitted:', response);
            this.submissionMessage = `Application submitted successfully! Status: ${response.status}`;
            if (response.status === 'rejected' && response.remarks?.length > 0) {
              this.submissionMessage += `<br>Reasons for rejection:<ul>${response.remarks.map((r: string) => `<li>${r}</li>`).join('')}</ul>`;
            }
            this.showSubmissionMessage = true;
            this.resetForm();
            setTimeout(() => {
              this.router.navigate(['/home']);
            }, 2000);
          },
          error: (error) => {
            console.error('Error submitting application:', error);
            console.log('Error response:', error.error);
            this.submissionMessage = error.error?.error || 'Error submitting application. Please try again.';
            this.showSubmissionMessage = true;
          },
          complete: () => {
            this.isSubmitting = false;
          }
        });
    } catch (error) {
      console.error('Error submitting application:', error);
      this.submissionMessage = error instanceof Error ? error.message : 'Error submitting application.';
      this.showSubmissionMessage = true;
      this.isSubmitting = false;
    }
  }
  
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }
  
  private resetForm(): void {
    this.applicationForm.reset({ terms: true });
    this.scholarship?.required_documents.forEach(doc => {
      this.documents[doc] = null;
    });
  }
  
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  logout(): void {
    this.authService.signOut().then(() => {
      this.router.navigate(['/auth/signin']);
    }).catch(error => {
      console.error('Logout error:', error);
      alert('Failed to log out. Please try again.');
    });
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }
}