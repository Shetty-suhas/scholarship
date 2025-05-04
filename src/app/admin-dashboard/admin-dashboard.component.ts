import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  created_at?: string;
}

interface Application {
  id: string;
  scholarship_id: string;
  user_id: string;
  student_name: string;
  student_email: string;
  status: string;
  submitted_at: string;
  documents: { name: string; file_id: string }[];
  verification_result: { documentValid: boolean; reasonForRejection: string[] };
  remarks: string[];
  payment_status?: string;
  payment_date?: string;
  payment_reference?: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  activeTab = 'scholarships';
  scholarshipForm!: FormGroup;
  scholarships: Scholarship[] = [];
  applications: Application[] = [];
  approvedApplications: Application[] = [];
  selectedScholarship: Scholarship | null = null;
  scholarshipApplications: Application[] = [];
  categories = ['Undergraduate', 'Graduate', 'International', 'Merit-based', 'Need-based'];
  isEditMode = false;
  editingScholarshipId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    this.scholarshipForm = this.fb.group({
      title: ['', Validators.required],
      provider: ['', Validators.required],
      amount: ['', Validators.required],
      deadline: ['', Validators.required],
      category: ['', Validators.required],
      description: ['', Validators.required],
      age_range: [''],
      income_range: [''],
      required_documents: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.loadScholarships();
    this.loadAllApplications();
    this.loadApprovedApplications();
  }

  get requiredDocuments(): FormArray {
    return this.scholarshipForm.get('required_documents') as FormArray;
  }

  addDocument(): void {
    this.requiredDocuments.push(this.fb.control('', Validators.required));
  }

  removeDocument(index: number): void {
    this.requiredDocuments.removeAt(index);
  }

  loadScholarships(): void {
    this.http.get<Scholarship[]>('http://localhost:5000/api/scholarships')
      .subscribe({
        next: (data) => {
          this.scholarships = data;
        },
        error: (err) => {
          console.error('Error loading scholarships:', err);
        }
      });
  }

  loadAllApplications(): void {
    this.http.get<Application[]>('http://localhost:5000/api/applications')
      .subscribe({
        next: (data) => {
          this.applications = data;
        },
        error: (err) => {
          console.error('Error loading applications:', err);
          this.applications = [];
        }
      });
  }

  loadApprovedApplications(): void {
    this.http.get<Application[]>('http://localhost:5000/api/applications')
      .subscribe({
        next: (data) => {
          this.approvedApplications = data.filter(app => app.status === 'approved');
        },
        error: (err) => {
          console.error('Error loading applications for finance tab:', err);
          this.approvedApplications = [];
          alert('Failed to load approved applications. Please try again later.');
        }
      });
  }

  getScholarshipTitle(scholarshipId: string): string {
    const scholarship = this.scholarships.find(s => s.id === scholarshipId);
    return scholarship ? scholarship.title : 'Unknown';
  }

  getScholarshipAmount(scholarshipId: string): string {
    const scholarship = this.scholarships.find(s => s.id === scholarshipId);
    return scholarship ? scholarship.amount : 'Unknown';
  }

  submitScholarship(): void {
    if (this.scholarshipForm.invalid) {
      this.markFormGroupTouched(this.scholarshipForm);
      return;
    }

    const scholarshipData: Scholarship = {
      ...this.scholarshipForm.value
    };

    let request: Observable<any>;
    if (this.isEditMode && this.editingScholarshipId) {
      request = this.http.put(
        `http://localhost:5000/api/scholarships/${this.editingScholarshipId}`,
        scholarshipData
      );
    } else {
      request = this.http.post(
        'http://localhost:5000/api/scholarships',
        scholarshipData
      );
    }

    request.subscribe({
      next: () => {
        this.loadScholarships();
        this.resetForm();
        this.activeTab = 'scholarships';
      },
      error: (err) => {
        console.error('Error saving scholarship:', err);
      }
    });
  }

  onStatusChange(event: Event, application: Application): void {
    const status = (event.target as HTMLSelectElement).value;
    this.updateApplicationStatus(application, status);
  }

  resetForm(): void {
    this.scholarshipForm.reset();
    this.requiredDocuments.clear();
    this.isEditMode = false;
    this.editingScholarshipId = null;
  }

  editScholarship(scholarship: Scholarship): void {
    this.isEditMode = true;
    this.editingScholarshipId = scholarship.id;
    while (this.requiredDocuments.length) {
      this.requiredDocuments.removeAt(0);
    }
    if (scholarship.required_documents && scholarship.required_documents.length) {
      scholarship.required_documents.forEach(doc => {
        this.requiredDocuments.push(this.fb.control(doc, Validators.required));
      });
    }
    this.scholarshipForm.patchValue({
      title: scholarship.title,
      provider: scholarship.provider,
      amount: scholarship.amount,
      deadline: scholarship.deadline,
      category: scholarship.category,
      description: scholarship.description,
      age_range: scholarship.age_range || '',
      income_range: scholarship.income_range || ''
    });
    this.activeTab = 'add-scholarship';
  }

  deleteScholarship(id: string): void {
    if (confirm('Are you sure you want to delete this scholarship?')) {
      this.http.delete(`http://localhost:5000/api/scholarships/${id}`)
        .subscribe({
          next: () => {
            this.loadScholarships();
          },
          error: (err) => {
            console.error('Error deleting scholarship:', err);
          }
        });
    }
  }

  viewApplications(scholarship: Scholarship): void {
    this.selectedScholarship = scholarship;
    this.http.get<Application[]>(`http://localhost:5000/api/applications/scholarship/${scholarship.id}`)
      .subscribe({
        next: (data) => {
          this.scholarshipApplications = data;
          this.activeTab = 'applications-detail';
        },
        error: (err) => {
          console.error('Error loading scholarship applications:', err);
          this.scholarshipApplications = [];
          this.activeTab = 'applications-detail';
        }
      });
  }

  updateApplicationStatus(application: Application, status: string): void {
    let updateData: { status: string; remarks?: string[] } = { status };
    if (status === 'Rejected') {
      const remarksInput = prompt('Enter rejection reasons (one per line):');
      if (remarksInput) {
        updateData.remarks = remarksInput.split('\n').filter(r => r.trim());
      }
    }

    this.http.put(`http://localhost:5000/api/applications/${application.id}`, updateData)
      .subscribe({
        next: () => {
          application.status = status;
          if (updateData.remarks) {
            application.remarks = updateData.remarks;
          }
          console.log('Application status updated');
          this.loadAllApplications();
          this.loadApprovedApplications();
          if (this.activeTab === 'applications-detail' && this.selectedScholarship) {
            this.viewApplications(this.selectedScholarship);
          }
        },
        error: (err) => {
          console.error('Error updating application status:', err);
        }
      });
  }

  makePayment(application: Application): void {
    if (confirm(`Are you sure you want to process payment for ${application.student_name}?`)) {
      const paymentData = {
        status: 'Awarded',
        payment_info: {
          payment_status: 'completed',
          payment_date: new Date().toISOString(),
          payment_reference: `PAY-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
        }
      };

      this.http.put(`http://localhost:5000/api/applications/${application.id}`, paymentData)
        .subscribe({
          next: (updatedApp: any) => {
            application.status = updatedApp.status;
            application.payment_status = updatedApp.payment_info.payment_status;
            application.payment_date = updatedApp.payment_info.payment_date;
            application.payment_reference = updatedApp.payment_info.payment_reference;
            console.log('Payment processed successfully');
            alert(`Payment processed successfully!\nReference: ${updatedApp.payment_info.payment_reference}`);
            this.loadApprovedApplications();
          },
          error: (err) => {
            console.error('Error processing payment:', err);
            alert('Failed to process payment: ' + (err.error?.error || 'Unknown error'));
          }
        });
    }
  }

  viewDocument(fileId: string): void {
    this.http.get(`http://localhost:5000/api/documents/${fileId}`, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `document-${fileId}.pdf`; 
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          console.log(`Document download initiated for file_id: ${fileId}`);
        },
        error: (err) => {
          console.error('Error downloading document:', err);
          alert('Failed to download document: ' + (err.error?.error || 'Unknown error'));
        }
      });
  }

  backToScholarships(): void {
    this.activeTab = 'scholarships';
    this.selectedScholarship = null;
    this.scholarshipApplications = [];
  }

  changeTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'scholarships') {
      this.loadScholarships();
    } else if (tab === 'applications') {
      this.loadAllApplications();
    } else if (tab === 'add-scholarship') {
      this.resetForm();
    } else if (tab === 'finance') {
      this.loadApprovedApplications();
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }
}