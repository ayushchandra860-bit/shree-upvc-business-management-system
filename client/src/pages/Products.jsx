import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { api, formatMoney } from '../api';
import EmptyState from '../components/EmptyState.jsx';

const blankProduct = {
  product_name: '',
  category: 'Window',
  rate_per_sqft: '',
  description: '',
  active: true
};

export default function Products({ setNotice }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState({ category_name: '', description: '', active: true });
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [form, setForm] = useState(blankProduct);
  const [editingId, setEditingId] = useState('');

  async function loadProducts() {
    const data = await api('/api/products?includeInactive=true');
    setProducts(data.products);
    setCategories(data.categories || []);
  }

  async function addCategory(event) {
    event.preventDefault();
    await api(editingCategoryId ? `/api/products/categories/${editingCategoryId}` : '/api/products/categories', {
      method: editingCategoryId ? 'PUT' : 'POST',
      body: JSON.stringify(categoryForm)
    });
    setCategoryForm({ category_name: '', description: '', active: true });
    setEditingCategoryId('');
    setNotice(editingCategoryId ? 'Product category updated' : 'Product category added');
    await loadProducts();
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function submit(event) {
    event.preventDefault();
    const path = editingId ? `/api/products/${editingId}` : '/api/products';
    const method = editingId ? 'PUT' : 'POST';
    await api(path, {
      method,
      body: JSON.stringify({
        ...form,
        rate_per_sqft: Number(form.rate_per_sqft)
      })
    });
    setForm(blankProduct);
    setEditingId('');
    setNotice(editingId ? 'Product updated' : 'Product added');
    await loadProducts();
  }

  function editProduct(product) {
    setEditingId(product.id);
    setForm({
      product_name: product.product_name,
      category: product.category,
      rate_per_sqft: product.rate_per_sqft,
      description: product.description,
      active: product.active
    });
  }

  async function deleteProduct(productId) {
    await api(`/api/products/${productId}`, { method: 'DELETE' });
    setNotice('Product deleted');
    await loadProducts();
  }

  function editCategory(category) {
    setEditingCategoryId(category.id);
    setCategoryForm({
      category_name: category.category_name,
      description: category.description || '',
      active: category.active
    });
  }

  async function deleteCategory(categoryId) {
    await api(`/api/products/categories/${categoryId}`, { method: 'DELETE' });
    setNotice('Product category deactivated');
    await loadProducts();
  }

  return (
    <div className="pageGrid">
      <section className="panel">
        <div className="sectionHeader">
          <h2>{editingId ? 'Update Product' : 'Add Product'}</h2>
        </div>
        <form className="formGrid" onSubmit={submit}>
          <label>
            Product Name
            <input value={form.product_name} onChange={(event) => setForm({ ...form, product_name: event.target.value })} required />
          </label>
          <label>
            Category
            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option>Window</option>
              <option>Door</option>
            </select>
          </label>
          <label>
            Rate Per Square Foot
            <input type="number" min="0" step="0.01" value={form.rate_per_sqft} onChange={(event) => setForm({ ...form, rate_per_sqft: event.target.value })} required />
          </label>
          <label className="toggleLine">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            Active
          </label>
          <label className="spanTwo">
            Description
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <div className="buttonRow">
            <button className="primaryButton" type="submit">
              {editingId ? <Save size={18} /> : <Plus size={18} />}
              {editingId ? 'Save Product' : 'Add Product'}
            </button>
            {editingId && (
              <button className="secondaryButton" type="button" onClick={() => { setEditingId(''); setForm(blankProduct); }}>
                <X size={18} />
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="sectionHeader">
          <h2>Product Categories</h2>
        </div>
        <form className="formGrid" onSubmit={addCategory}>
          <label>
            Category Name
            <input value={categoryForm.category_name} onChange={(event) => setCategoryForm({ ...categoryForm, category_name: event.target.value })} required />
          </label>
          <label>
            Description
            <input value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} />
          </label>
          <button className="secondaryButton" type="submit"><Plus size={18} />{editingCategoryId ? 'Save Category' : 'Add Category'}</button>
          {editingCategoryId && <button className="secondaryButton" type="button" onClick={() => { setEditingCategoryId(''); setCategoryForm({ category_name: '', description: '', active: true }); }}><X size={18} />Cancel</button>}
        </form>
        <div className="categoryPills">
          {categories.map((category) => (
            <span key={category.id}>
              {category.category_name}
              <button type="button" onClick={() => editCategory(category)}>Edit</button>
              <button type="button" onClick={() => deleteCategory(category.id)}>Delete</button>
            </span>
          ))}
        </div>
      </section>

      <section className="panel widePanel">
        <div className="sectionHeader">
          <h2>Products</h2>
        </div>
        {products.length ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th className="amountCell">Rate Per Sq.Ft</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.product_name}</td>
                    <td>{product.category}</td>
                    <td className="amountCell">{formatMoney(product.rate_per_sqft)}</td>
                    <td>{product.description}</td>
                    <td>{product.active ? 'Active' : 'Inactive'}</td>
                    <td>
                      <div className="tableActions">
                        <button type="button" className="textButton" onClick={() => editProduct(product)}>Edit</button>
                        <button type="button" className="iconButton small" title="Delete product" onClick={() => deleteProduct(product.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No products found" />
        )}
      </section>
    </div>
  );
}
