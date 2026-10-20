"""Add payment provider abstraction and payment_transactions table

Revision ID: 014_add_payment_provider_abstraction
Revises: 013_add_onboarding_status
Create Date: 2026-10-06 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '014_add_payment_provider_abstraction'
down_revision: Union[str, None] = '013_add_onboarding_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    context = op.get_context()
    if getattr(context, "as_sql", False):
        op.alter_column('subscriptions', 'stripe_customer_id', existing_type=sa.String(100), nullable=True)
        op.add_column('subscriptions', sa.Column('provider', sa.String(length=50), server_default='stripe', nullable=False))
        op.add_column('subscriptions', sa.Column('provider_customer_id', sa.String(length=100), nullable=True))
        op.add_column('subscriptions', sa.Column('provider_subscription_id', sa.String(length=100), nullable=True))
        op.add_column('subscriptions', sa.Column('currency', sa.String(length=10), server_default='usd', nullable=False))
        op.add_column('subscriptions', sa.Column('billing_interval', sa.String(length=20), server_default='month', nullable=False))
        op.add_column('subscriptions', sa.Column('amount_cents', sa.Integer(), nullable=True))
        op.add_column('subscriptions', sa.Column('razorpay_customer_id', sa.String(length=100), nullable=True))
        op.add_column('subscriptions', sa.Column('razorpay_subscription_id', sa.String(length=100), nullable=True))
        op.add_column('subscriptions', sa.Column('razorpay_plan_id', sa.String(length=100), nullable=True))
        op.create_index('ix_subscriptions_provider_sub_id', 'subscriptions', ['provider', 'provider_subscription_id'])
        op.create_index('ix_subscriptions_razorpay_sub_id', 'subscriptions', ['razorpay_subscription_id'])
        op.create_table(
            'payment_transactions',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('provider', sa.String(length=50), nullable=False),
            sa.Column('provider_payment_id', sa.String(length=100), unique=True, index=True, nullable=False),
            sa.Column('provider_subscription_id', sa.String(length=100), index=True, nullable=True),
            sa.Column('provider_event_id', sa.String(length=100), index=True, nullable=True),
            sa.Column('amount', sa.Integer(), nullable=False),
            sa.Column('currency', sa.String(length=10), server_default='inr', nullable=False),
            sa.Column('status', sa.String(length=50), server_default='succeeded', nullable=False),
            sa.Column('plan', sa.String(length=50), nullable=True),
            sa.Column('billing_interval', sa.String(length=20), nullable=True),
            sa.Column('payment_method', sa.String(length=50), nullable=True),
            sa.Column('error_code', sa.String(length=100), nullable=True),
            sa.Column('error_description', sa.String(length=500), nullable=True),
            sa.Column('refund_id', sa.String(length=100), nullable=True),
            sa.Column('refund_amount', sa.Integer(), nullable=True),
            sa.Column('metadata_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
        return

    bind = op.get_bind()
    insp = sa.inspect(bind)

    sub_columns = [c['name'] for c in insp.get_columns('subscriptions')]
    
    # 1. Relax stripe_customer_id NOT NULL constraint for non-Stripe providers
    if 'stripe_customer_id' in sub_columns:
        op.alter_column('subscriptions', 'stripe_customer_id', existing_type=sa.String(100), nullable=True)

    # 2. Add provider-agnostic and Razorpay-specific columns to subscriptions
    new_sub_cols = {
        'provider': sa.Column('provider', sa.String(length=50), server_default='stripe', nullable=False),
        'provider_customer_id': sa.Column('provider_customer_id', sa.String(length=100), nullable=True),
        'provider_subscription_id': sa.Column('provider_subscription_id', sa.String(length=100), nullable=True),
        'currency': sa.Column('currency', sa.String(length=10), server_default='usd', nullable=False),
        'billing_interval': sa.Column('billing_interval', sa.String(length=20), server_default='month', nullable=False),
        'amount_cents': sa.Column('amount_cents', sa.Integer(), nullable=True),
        'razorpay_customer_id': sa.Column('razorpay_customer_id', sa.String(length=100), nullable=True),
        'razorpay_subscription_id': sa.Column('razorpay_subscription_id', sa.String(length=100), nullable=True),
        'razorpay_plan_id': sa.Column('razorpay_plan_id', sa.String(length=100), nullable=True),
    }

    for col_name, col_def in new_sub_cols.items():
        if col_name not in sub_columns:
            op.add_column('subscriptions', col_def)

    # 3. Add composite index on provider and provider_subscription_id
    sub_indexes = [idx['name'] for idx in insp.get_indexes('subscriptions')]
    if 'ix_subscriptions_provider_sub_id' not in sub_indexes:
        op.create_index(
            'ix_subscriptions_provider_sub_id',
            'subscriptions',
            ['provider', 'provider_subscription_id'],
        )
    if 'ix_subscriptions_razorpay_sub_id' not in sub_indexes:
        op.create_index(
            'ix_subscriptions_razorpay_sub_id',
            'subscriptions',
            ['razorpay_subscription_id'],
        )

    # 4. Create payment_transactions table for ledger history
    tables = insp.get_table_names()
    if 'payment_transactions' not in tables:
        op.create_table(
            'payment_transactions',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('provider', sa.String(length=50), nullable=False),
            sa.Column('provider_payment_id', sa.String(length=100), unique=True, index=True, nullable=False),
            sa.Column('provider_subscription_id', sa.String(length=100), index=True, nullable=True),
            sa.Column('provider_event_id', sa.String(length=100), index=True, nullable=True),
            sa.Column('amount', sa.Integer(), nullable=False),
            sa.Column('currency', sa.String(length=10), server_default='inr', nullable=False),
            sa.Column('status', sa.String(length=50), server_default='succeeded', nullable=False),
            sa.Column('plan', sa.String(length=50), nullable=True),
            sa.Column('billing_interval', sa.String(length=20), nullable=True),
            sa.Column('payment_method', sa.String(length=50), nullable=True),
            sa.Column('error_code', sa.String(length=100), nullable=True),
            sa.Column('error_description', sa.String(length=500), nullable=True),
            sa.Column('refund_id', sa.String(length=100), nullable=True),
            sa.Column('refund_amount', sa.Integer(), nullable=True),
            sa.Column('metadata_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    tables = insp.get_table_names()
    if 'payment_transactions' in tables:
        op.drop_table('payment_transactions')

    sub_indexes = [idx['name'] for idx in insp.get_indexes('subscriptions')]
    if 'ix_subscriptions_provider_sub_id' in sub_indexes:
        op.drop_index('ix_subscriptions_provider_sub_id', table_name='subscriptions')
    if 'ix_subscriptions_razorpay_sub_id' in sub_indexes:
        op.drop_index('ix_subscriptions_razorpay_sub_id', table_name='subscriptions')

    sub_columns = [c['name'] for c in insp.get_columns('subscriptions')]
    cols_to_drop = [
        'razorpay_plan_id', 'razorpay_subscription_id', 'razorpay_customer_id',
        'amount_cents', 'billing_interval', 'currency', 'provider_subscription_id',
        'provider_customer_id', 'provider'
    ]
    for col in cols_to_drop:
        if col in sub_columns:
            op.drop_column('subscriptions', col)
