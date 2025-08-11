-- Initialize database schema for MCP Database Server
-- This script runs when the PostgreSQL container starts for the first time

-- Create a sample table for testing
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    department VARCHAR(50),
    salary DECIMAL(10,2),
    hire_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some sample data
INSERT INTO employees (name, email, department, salary) VALUES
    ('John Doe', 'john.doe@company.com', 'Engineering', 75000.00),
    ('Jane Smith', 'jane.smith@company.com', 'Marketing', 65000.00),
    ('Bob Johnson', 'bob.johnson@company.com', 'Sales', 70000.00),
    ('Alice Brown', 'alice.brown@company.com', 'Engineering', 80000.00),
    ('Charlie Wilson', 'charlie.wilson@company.com', 'HR', 60000.00)
ON CONFLICT (email) DO NOTHING;

-- Create another sample table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    budget DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample project data
INSERT INTO projects (name, description, status, budget) VALUES
    ('Website Redesign', 'Redesign company website with modern UI/UX', 'active', 50000.00),
    ('Mobile App Development', 'Develop iOS and Android mobile applications', 'planning', 100000.00),
    ('Database Migration', 'Migrate from legacy system to PostgreSQL', 'completed', 25000.00)
ON CONFLICT DO NOTHING;

-- Create a junction table for employee-project relationships
CREATE TABLE IF NOT EXISTS employee_projects (
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    role VARCHAR(50),
    assigned_date DATE DEFAULT CURRENT_DATE,
    PRIMARY KEY (employee_id, project_id)
);

-- Insert sample employee-project assignments
INSERT INTO employee_projects (employee_id, project_id, role) VALUES
    (1, 1, 'Lead Developer'),
    (1, 2, 'Technical Lead'),
    (2, 1, 'UI/UX Designer'),
    (3, 3, 'Project Manager'),
    (4, 2, 'Backend Developer'),
    (5, 1, 'QA Tester')
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_employee_projects_employee ON employee_projects(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_projects_project ON employee_projects(project_id);
