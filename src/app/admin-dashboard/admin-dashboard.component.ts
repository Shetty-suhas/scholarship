import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';

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
  created_at?: string;
  required_documents?: string[];
}

interface Application {
  id: string;
  scholarship_id: string;
  student_name: string;
  student_email: string;
  status: string;
  submitted_at: string;
  documents: {
    name: string;
    url: string;
  }[];
}

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
  imports: [ReactiveFormsModule, CommonModule],
})
export class AdminDashboardComponent implements OnInit {
  activeTab = 'scholarships';
  scholarshipForm: FormGroup;
  scholarships: Scholarship[] = [];
  applications: Application[] = [];
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

  onStatusChange(event: Event, application: any): void {
    const value = (event.target as HTMLSelectElement).value;
    this.updateApplicationStatus(application, value);
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
          // Mock data for demonstration
          this.applications = [
            {
              id: '1',
              scholarship_id: '1',
              student_name: 'Jane Smith',
              student_email: 'jane@example.com',
              status: 'pending',
              submitted_at: '2025-04-28T10:30:00',
              documents: [
                { name: 'Transcript', url: '/assets/docs/transcript.pdf' },
                { name: 'ID', url: '/assets/docs/id.pdf' }
              ]
            },
            {
              id: '2',
              scholarship_id: '2',
              student_name: 'John Doe',
              student_email: 'john@example.com',
              status: 'approved',
              submitted_at: '2025-04-27T09:15:00',
              documents: [
                { name: 'Transcript', url: '/assets/docs/transcript2.pdf' },
                { name: 'Letter', url: '/assets/docs/letter.pdf' }
              ]
            }
          ];
        }
      });
  }

  getScholarshipTitle(scholarshipId: string): string {
    const scholarship = this.scholarships.find(s => s.id === scholarshipId);
    return scholarship ? scholarship.title : 'Unknown';
  }

  submitScholarship(): void {
    if (this.scholarshipForm.invalid) {
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
      next: (response) => {
        this.loadScholarships();
        this.resetForm();
      },
      error: (err) => {
        console.error('Error saving scholarship:', err);
      }
    });
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
    this.scholarshipApplications = this.applications.filter(
      app => app.scholarship_id === scholarship.id
    );
    this.activeTab = 'applications-detail';
  }

  updateApplicationStatus(application: Application, status: string): void {
    application.status = status;
    
    this.http.put(`http://localhost:5000/api/applications/${application.id}`, {
      status: status
    }).subscribe({
      next: () => {
        console.log('Application status updated');
      },
      error: (err) => {
        console.error('Error updating application status:', err);
      }
    });
  }

  backToScholarships(): void {
    this.activeTab = 'scholarships';
    this.selectedScholarship = null;
  }

  changeTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'scholarships') {
      this.loadScholarships();
    } else if (tab === 'applications') {
      this.loadAllApplications();
    } else if (tab === 'add-scholarship') {
      this.resetForm();
    }
  }
}