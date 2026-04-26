'use client';

import Link from 'next/link';
import { ArrowRight, Activity, TrendingUp, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white bg-opacity-80 backdrop-blur">
        <div className="text-2xl font-bold text-blue-600">PhysioCare</div>
        <div className="flex gap-3 flex-wrap justify-end">
          <Link href="/auth/login/patient">
            <Button variant="outline" className="text-sm">Patient Login</Button>
          </Link>
          <Link href="/auth/login/doctor">
            <Button variant="outline" className="text-sm">Doctor Login</Button>
          </Link>
          <Link href="/auth/login/admin">
            <Button className="bg-blue-600 hover:bg-blue-700 text-sm">Admin Login</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-20 sm:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-blue-100 text-blue-600 rounded-full text-sm font-semibold">
            AI-Powered Physical Therapy
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Your Personal AI
            <br />
            Physical Therapy Coach
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Real-time pose detection, personalized exercise plans, and progress tracking. Accelerate your recovery with intelligent feedback.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/auth/login/patient">
              <Button size="lg" className="gap-2">
                Start Your Recovery <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="outline" size="lg">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="px-6 py-16 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">15,000+</div>
              <p className="text-gray-600">Active Patients</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-teal-600 mb-2">2,500+</div>
              <p className="text-gray-600">Healthcare Professionals</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">94%</div>
              <p className="text-gray-600">Recovery Rate</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-600 mb-2">5M+</div>
              <p className="text-gray-600">Sessions Completed</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">Why Choose PhysioCare?</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <Zap className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Real-Time AI Feedback</h3>
              <p className="text-gray-600">
                Advanced pose detection using TensorFlow.js provides instant feedback on your form and technique.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition">
              <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mb-4">
                <Activity className="w-7 h-7 text-teal-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Personalized Plans</h3>
              <p className="text-gray-600">
                Your physical therapist creates customized exercise programs tailored to your specific needs and recovery goals.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <TrendingUp className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Progress Tracking</h3>
              <p className="text-gray-600">
                Visualize your improvement with detailed analytics and reports. Share progress with your healthcare team.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition">
              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <Shield className="w-7 h-7 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Secure & Private</h3>
              <p className="text-gray-600">
                Your health data is protected with enterprise-grade security and HIPAA-compliant infrastructure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">How It Works</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Sign Up</h3>
              <p className="text-gray-600">Create your account and connect with your physical therapist or start your journey.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-teal-600 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Get Personalized Plan</h3>
              <p className="text-gray-600">Receive a customized exercise program based on your condition and goals.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-600 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Recover Faster</h3>
              <p className="text-gray-600">Complete exercises with AI guidance and track your progress in real-time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-gradient-to-r from-blue-600 to-teal-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Start Your Recovery?</h2>
          <p className="text-xl text-blue-100 mb-8">Join thousands of patients achieving their therapy goals with PhysioCare.</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="gap-2">
                Create Free Account <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-blue-600">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-gray-200 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-lg font-bold text-blue-600">PhysioCare</div>
            <div className="flex gap-8 text-sm text-gray-600">
              <a href="#" className="hover:text-blue-600">About</a>
              <a href="#" className="hover:text-blue-600">Privacy</a>
              <a href="#" className="hover:text-blue-600">Terms</a>
              <a href="#" className="hover:text-blue-600">Contact</a>
            </div>
            <div className="text-sm text-gray-600">© 2024 PhysioCare. All rights reserved.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
